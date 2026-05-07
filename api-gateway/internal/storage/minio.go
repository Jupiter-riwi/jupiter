package storage

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"os"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type MinioClient struct {
	client         *minio.Client
	bucket         string
	publicEndpoint string
	securePublic   bool
}

func NewMinioClient() (*MinioClient, error) {
	endpoint := os.Getenv("MINIO_ENDPOINT")
	accessKey := os.Getenv("MINIO_ACCESS_KEY")
	secretKey := os.Getenv("MINIO_SECRET_KEY")
	bucket := os.Getenv("MINIO_BUCKET")
	useSSL := os.Getenv("MINIO_USE_SSL") == "true"

	publicEndpoint := os.Getenv("MINIO_PUBLIC_ENDPOINT")
	if publicEndpoint == "" {
		publicEndpoint = endpoint
	}
	publicUseSSL := os.Getenv("MINIO_PUBLIC_USE_SSL") == "true"
	if os.Getenv("MINIO_PUBLIC_USE_SSL") == "" {
		publicUseSSL = useSSL
	}

	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("minio client: %w", err)
	}

	return &MinioClient{
		client:         client,
		bucket:         bucket,
		publicEndpoint: publicEndpoint,
		securePublic:   publicUseSSL,
	}, nil
}

// PresignedPutURL generates a presigned URL for direct video upload.
func (m *MinioClient) PresignedPutURL(ctx context.Context, objectKey string, expiry time.Duration) (string, error) {
	presignedURL, err := m.client.PresignedPutObject(ctx, m.bucket, objectKey, expiry)
	if err != nil {
		return "", fmt.Errorf("presigned put: %w", err)
	}

	if m.publicEndpoint == "" {
		return presignedURL.String(), nil
	}

	parsed, err := url.Parse(presignedURL.String())
	if err != nil {
		return "", fmt.Errorf("parse presigned url: %w", err)
	}

	parsed.Host = m.publicEndpoint
	if m.securePublic {
		parsed.Scheme = "https"
	} else {
		parsed.Scheme = "http"
	}

	return parsed.String(), nil
}

// PutObject stores an object from a reader in the MinIO bucket.
func (m *MinioClient) PutObject(ctx context.Context, objectKey string, reader io.Reader, size int64) (int64, error) {
	info, err := m.client.PutObject(ctx, m.bucket, objectKey, reader, size, minio.PutObjectOptions{})
	if err != nil {
		return 0, fmt.Errorf("put object: %w", err)
	}
	return info.Size, nil
}

// GetBucket returns the configured bucket name.
func (m *MinioClient) GetBucket() string {
	return m.bucket
}

// EnsureBucket creates the bucket if it does not exist.
func (m *MinioClient) EnsureBucket(ctx context.Context) error {
	exists, err := m.client.BucketExists(ctx, m.bucket)
	if err != nil {
		return err
	}
	if !exists {
		return m.client.MakeBucket(ctx, m.bucket, minio.MakeBucketOptions{})
	}
	return nil
}
