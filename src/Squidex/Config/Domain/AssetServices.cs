﻿// ==========================================================================
//  Squidex Headless CMS
// ==========================================================================
//  Copyright (c) Squidex UG (haftungsbeschränkt)
//  All rights reserved. Licensed under the MIT license.
// ==========================================================================

using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;
using MongoDB.Driver.GridFS;
using Squidex.Infrastructure;
using Squidex.Infrastructure.Assets;
using Squidex.Infrastructure.Assets.ImageSharp;
using Squidex.Infrastructure.Log;

namespace Squidex.Config.Domain
{
    public static class AssetServices
    {
        public static void AddMyAssetServices(this IServiceCollection services, IConfiguration config)
        {
            config.ConfigureByOption("assetStore:type", new Options
            {
                ["Folder"] = () =>
                {
                    var path = config.GetRequiredValue("assetStore:folder:path");

                    services.AddSingletonAs(c => new FolderAssetStore(path, c.GetRequiredService<ISemanticLog>()))
                        .As<IAssetStore>()
                        .As<IInitializable>();
                },
                ["GoogleCloud"] = () =>
                {
                    var bucketName = config.GetRequiredValue("assetStore:googleCloud:bucket");

                    services.AddSingletonAs(c => new GoogleCloudAssetStore(bucketName))
                        .As<IAssetStore>()
                        .As<IInitializable>();
                },
                ["AzureBlob"] = () =>
                {
                    var connectionString = config.GetRequiredValue("assetStore:azureBlob:connectionString");
                    var containerName = config.GetRequiredValue("assetStore:azureBlob:containerName");

                    services.AddSingletonAs(c => new AzureBlobAssetStore(connectionString, containerName))
                        .As<IAssetStore>()
                        .As<IInitializable>();
                },
                ["MongoDb"] = () =>
                {
                    var mongoConfiguration = config.GetRequiredValue("assetStore:mongoDb:configuration");
                    var mongoDatabaseName = config.GetRequiredValue("assetStore:mongoDb:database");
                    var mongoGridFsBucketName = config.GetRequiredValue("assetStore:mongoDb:bucket");

                    services.AddSingletonAs(c =>
                        {
                            var mongoClient = Singletons<IMongoClient>.GetOrAdd(mongoConfiguration, s => new MongoClient(s));
                            var mongoDatabase = mongoClient.GetDatabase(mongoDatabaseName);

                            var gridFsbucket = new GridFSBucket<string>(mongoDatabase, new GridFSBucketOptions
                            {
                                BucketName = mongoGridFsBucketName
                            });

                            return new MongoGridFsAssetStore(gridFsbucket);
                        })
                        .As<IAssetStore>()
                        .As<IInitializable>();
                }
            });

            services.AddSingletonAs<ImageSharpAssetThumbnailGenerator>()
                .As<IAssetThumbnailGenerator>();
        }
    }
}
